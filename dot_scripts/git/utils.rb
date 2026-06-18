# frozen_string_literal: true

# Shared utilities for git-* Ruby scripts.
# Usage: require_relative 'utils'

require 'English'
require 'optparse'
require 'shellwords'

module Utils
  extend self

  # Run a shell command, exit on failure.
  def shell(command)
    output = `#{command} 2>&1`

    unless $CHILD_STATUS.success?
      warn "Error running: #{command}"
      warn output unless output.strip.empty?
      exit(-1)
    end

    output
  end

  # Detect the default branch (main/master) from origin.
  def detect_default_branch
    ref = `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`.strip
    if ref.empty?
      `git remote set-head origin --auto 2>/dev/null`
      ref = `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`.strip
    end
    ref.empty? ? "main" : ref.sub("refs/remotes/origin/", "")
  end

  # Return the git repo root directory.
  def repo_root
    root = `git rev-parse --show-toplevel 2>/dev/null`.strip
    root.empty? ? nil : root
  end

  # Run an AI model with a prompt, return [success, output].
  #
  # provider: :claude (default) or :opencode
  #
  # For :claude, model accepts aliases ("haiku", "sonnet", "opus") or full IDs.
  # Defaults to "haiku" to keep scripts fast and cheap.
  #
  # For :opencode, model uses "provider/model" format (e.g. "anthropic/claude-sonnet-4-6").
  # Defaults to "openai/gpt-5.4-mini".
  #
  # env_prefix selects which override vars are read (default "DOTFILES" ->
  # DOTFILES_MODEL / DOTFILES_PROVIDER). The triage pass passes "DOTFILES_TRIAGE"
  # so it can run a cheaper model independently of the main one.
  def ai_generate(prompt, model: nil, provider: :claude, env_prefix: "DOTFILES")
    model = ENV.fetch("#{env_prefix}_MODEL", model)
    provider = ENV.fetch("#{env_prefix}_PROVIDER", provider.to_s).to_sym
    case provider
    when :claude
      ai_generate_claude(prompt, model: model || "haiku")
    when :opencode
      ai_generate_opencode(prompt, model: model || "openai/gpt-5.4-mini")
    else
      raise ArgumentError, "Unknown provider: #{provider}"
    end
  end

  private

  def debug(msg)
    warn "[DEBUG] #{msg}" if ENV["DEBUG"]
  end

  def ai_generate_claude(prompt, model:)
    cmd = ["claude", "--print", "--model", model, "--no-session-persistence", "--tools", "", "--disable-slash-commands", "--strict-mcp-config", "-"]
    debug "model=#{model}"
    debug "command=#{cmd.join(" ")}"
    output = IO.popen(cmd,
      "r+", err: %i[child out]
    ) do |io|
      io.write(prompt)
      io.close_write
      io.read
    end

    [$CHILD_STATUS.success? && !output.strip.empty?, output.strip]
  end

  def ai_generate_opencode(prompt, model:)
    cmd = %w[opencode run --dir /tmp]
    cmd += ["--model", model] if model
    cmd << prompt

    debug "model=#{model}"
    debug "command=#{cmd.join(" ")}"
    output = IO.popen(cmd, err: %i[child out], &:read)
    output = output.gsub(/\e\[[0-9;]*m/, "")
                   .lines
                   .reject { |l| l.strip.start_with?(">") }
                   .join
                   .strip

    [$CHILD_STATUS.success? && !output.empty?, output]
  end

  public

  # Strip wrapping code fences from AI output.
  def strip_code_fences(text)
    text.sub(/\A```[^\n]*\n/, "").sub(/\n```\z/, "").strip
  end

  # Wrap text to a given width.
  def wrap(text, width = 72)
    text.gsub(/(.{1,#{width}})(\s+|\z)/, "\\1\n").rstrip
  end

  # One-line style guidance for a commit subject / MR / PR title, shared by
  # git-wip, git-mr, and git-pr so the rules stay in a single place.
  def title_style(label, max_chars: 70)
    "Write the #{label} in imperative mood, with no trailing period, under " \
      "#{max_chars} characters. If the branch name or commits contain a ticket " \
      "or issue ID, prefix the #{label} with it."
  end

  # Split AI output into [title, body], tolerant of the things models do
  # even when told "first line = title": leading blank lines, a stray code
  # fence, a markdown heading (`# ...`), bold (`**...**`), surrounding quotes,
  # or a "Title:"/"Subject:" label. Returns `fallback` for the title if none
  # can be found. `body` has leading blank lines trimmed.
  def split_title_body(text, fallback: nil)
    lines = strip_code_fences(text).lines.map(&:rstrip)
    idx = lines.index { |l| !l.strip.empty? && !l.strip.start_with?("```") }
    return [fallback, ""] unless idx

    title = lines[idx].strip
                      .sub(/\A#+\s+/, "")                          # markdown heading
                      .sub(/\A(?:title|subject)\s*[:\-]\s*/i, "")  # "Title:" / "Subject -"
                      .sub(/\A\*\*(.*)\*\*\z/, '\1')               # **bold**
                      .sub(/\A["'](.*)["']\z/, '\1')               # "quoted"
                      .strip
    title = fallback if title.empty?

    body = lines.drop(idx + 1).drop_while { |l| l.strip.empty? }.join("\n").strip
    [title, body]
  end

  # Find a template file, returning [content, path] or [nil, nil].
  # `candidates` are repo-relative file paths tried in order; `dirs` are
  # repo-relative directories whose *.md are globbed (Default.md preferred).
  def find_template(candidates: [], dirs: [])
    root = repo_root
    return [nil, nil] unless root

    candidates.each do |rel|
      path = File.join(root, rel)
      return [File.read(path), path] if File.exist?(path)
    end

    dirs.each do |reldir|
      dir = File.join(root, reldir)
      next unless Dir.exist?(dir)

      templates = Dir.glob("#{dir}/*.md")
      next if templates.empty?

      default = templates.find { |f| File.basename(f).downcase == "default.md" }
      path = default || templates.first
      return [File.read(path), path] if path
    end

    [nil, nil]
  end

  # Shared driver for `git mr` (GitLab) and `git pr` (GitHub). `forge` is a
  # hash describing the differences between the two:
  #   cmd, abbr, noun, noun_short, host_label, remote_host,
  #   template_candidates, template_dirs, create
  # where `create` is a proc (title, description, target) -> shell command.
  def create_change_request(forge)
    target = nil
    OptionParser.new do |opts|
      opts.banner = "Usage: git #{forge[:cmd]} [options]\n\nCreate a #{forge[:noun]} with an AI-generated description.\n\n"
      opts.on("-t", "--target BRANCH", "Target branch (default: auto-detect)") { |v| target = v }
    end.parse!

    remote_url = `git remote get-url origin 2>/dev/null`.strip
    unless remote_url.include?(forge[:remote_host])
      warn "Remote origin does not point to #{forge[:host_label]}: #{remote_url}"
      exit(1)
    end

    branch = shell("git rev-parse --abbrev-ref HEAD").strip
    target ||= detect_default_branch

    if branch == target
      warn "Already on #{target}, nothing to merge."
      exit(1)
    end

    # Make sure we have the latest remote state
    shell("git fetch origin #{target}")

    log = shell("git log origin/#{target}..HEAD --oneline")
    diff_range = "origin/#{target}...HEAD"

    if `git diff --name-only #{diff_range}`.strip.empty?
      warn "No changes between #{branch} and #{target}."
      exit(1)
    end

    diff = relevant_diff(diff_range, log: log)

    template, template_path = find_template(
      candidates: forge[:template_candidates] || [],
      dirs: forge[:template_dirs] || []
    )
    if template
      puts "Using #{forge[:abbr]} template: #{template_path}"
    else
      puts "No #{forge[:abbr]} template found, using default format."
    end

    prompt = build_request_prompt(forge, template: template, log: log, diff: diff)

    puts "Generating #{forge[:abbr]} description with AI..."
    success, ai_output = ai_generate(prompt, model: "sonnet")

    if success
      title, description = split_title_body(ai_output, fallback: branch)
    else
      warn "Warning: AI generation failed, using commit log as description."
      warn ai_output unless ai_output.empty?
      title = log.lines.first&.strip&.sub(/^[a-f0-9]+\s+/, "") || branch
      description = log
    end

    puts "Creating #{forge[:abbr]}: #{title}"

    # Push branch if needed
    shell("git push -u origin #{branch}")

    output = `#{forge[:create].call(title, description, target)} 2>&1`
    unless $CHILD_STATUS.success?
      warn "Error creating #{forge[:abbr]}:"
      warn output
      exit(-1)
    end
    puts output
  end

  SELECTION_MIN_FILES = 2
  SELECTION_MIN_BYTES = 4_000
  # Pass-1 triage runs a cheap model independent of the main one; override with
  # DOTFILES_TRIAGE_PROVIDER / DOTFILES_TRIAGE_MODEL.
  TRIAGE_PROVIDER = :opencode
  TRIAGE_MODEL = "openai/gpt-5.4-mini"

  # Assemble a token-efficient diff context. A cheap first pass shows the model
  # only the changed-file list (name-status + stat) and commit subjects and asks
  # which files it must read in full; the caller's generation pass then sees only
  # those diffs, plus the stat and the names of the skipped files.
  #
  # `diff_args` is shared by `git diff`, `--stat`, and `--name-status`
  # (e.g. "origin/main...HEAD" or "--cached"). Returns a single string.
  def relevant_diff(diff_args, log: "")
    full = `git diff #{diff_args}`
    stat = `git diff --stat #{diff_args}`.strip
    name_status = `git diff --name-status #{diff_args}`.strip
    changed = name_status.lines.filter_map { |l| l.split("\t").last&.strip }

    # An extra model call isn't worth it for tiny or single-file diffs.
    return full if changed.size < SELECTION_MIN_FILES || full.bytesize < SELECTION_MIN_BYTES

    selected = select_files(name_status, stat, log, changed)
    omitted = changed - selected

    sections = ["Changed files:\n#{stat}"]
    unless selected.empty?
      escaped = selected.map(&:shellescape).join(" ")
      sections << "Full diff of the files that need review:\n#{`git diff #{diff_args} -- #{escaped}`.strip}"
    end
    sections << "Other changed files (path/status only):\n#{omitted.join("\n")}" unless omitted.empty?
    sections.join("\n\n")
  end

  private

  # Pass 1 of relevant_diff: ask the model which files need a full-diff read.
  # Falls back to "all files" on error or unparseable output; honors NONE.
  def select_files(name_status, stat, log, changed)
    commits = log.strip.empty? ? "" : "\n\nCommits:\n#{log.strip}"
    prompt = <<~PROMPT
      You are gathering context to summarize a set of code changes.
      Below are the changed files (git status + line counts).
      List the files whose FULL DIFF you must read to summarize the changes accurately.
      Skip files where the path and change type already tell the story: lock files,
      generated or minified files, vendored dependencies, and pure renames or deletions.
      Output one file path per line, exactly as written below, and nothing else.
      Output NONE if the file list alone is enough.

      Files:
      #{name_status}

      Stat:
      #{stat}#{commits}
    PROMPT

    success, output = ai_generate(prompt, provider: TRIAGE_PROVIDER, model: TRIAGE_MODEL, env_prefix: "DOTFILES_TRIAGE")
    return changed unless success

    output = strip_code_fences(output)
    return [] if output.match?(/\A\s*NONE\s*\z/i)

    picks = output.lines.filter_map do |l|
      cleaned = l.strip.sub(/\A[-*]\s+/, "").gsub(/[`'"]/, "").strip
      cleaned unless cleaned.empty?
    end
    selected = picks & changed
    selected.empty? ? changed : selected
  end

  # Build the AI prompt for create_change_request. Body instructions are
  # identical across forges; only the noun/abbr wording varies.
  def build_request_prompt(forge, template:, log:, diff:)
    if template
      intro = "Fill in this #{forge[:noun_short]} template based on the changes below."
      body = <<~BODY.rstrip
        Everything after that is the filled template body. Plain text with markdown. Do not wrap in a code block.
        Preserve the template's headings and their order. Replace placeholder comments (e.g. <!-- ... -->) with real content, and delete the comment markers.
        Leave "N/A" where the diff does not tell you. Do not tick checkboxes unless the diff clearly satisfies them.
      BODY
    else
      intro = "Write a #{forge[:noun]} description for these changes."
      body = "Everything after that is the description body with a summary section. Use markdown. Do not wrap in a code block."
    end

    sections = [<<~HEAD.rstrip]
      #{intro}
      Output only the title and body — no preamble, explanation, or surrounding text.
      The FIRST line of your output must be the #{forge[:abbr]} title.
      #{title_style("title")}
      The SECOND line must be blank.
      #{body}
    HEAD
    sections << "Template:\n#{template}" if template
    sections << "Commits:\n#{log}"
    sections << "Changes:\n#{diff}"
    sections.join("\n\n")
  end
end
