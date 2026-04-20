# Shared utilities for git-* Ruby scripts.
# Usage: require_relative 'utils'

module Utils
  # Run a shell command, exit on failure.
  def self.shell(command)
    output = `#{command} 2>&1`

    unless $?.success?
      $stderr.puts "Error running: #{command}"
      $stderr.puts output unless output.strip.empty?
      exit(-1)
    end

    output
  end

  # Detect the default branch (main/master) from origin.
  def self.detect_default_branch
    ref = `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`.strip
    if ref.empty?
      `git remote set-head origin --auto 2>/dev/null`
      ref = `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`.strip
    end
    ref.empty? ? "main" : ref.sub("refs/remotes/origin/", "")
  end

  # Return the git repo root directory.
  def self.repo_root
    root = `git rev-parse --show-toplevel 2>/dev/null`.strip
    root.empty? ? nil : root
  end

  # Run Claude in print mode with a prompt, return [success, output].
  #
  # The `model` argument is passed through to `claude --model`. Accepted values
  # (see `claude --help`):
  #   - Aliases: "haiku", "sonnet", "opus" (resolve to the latest of each tier)
  #   - Full IDs: "claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"
  # Default is "haiku" to keep these scripts fast and cheap.
  def self.claude_generate(prompt, model: "haiku")
    output = IO.popen(
      ["claude", "--print", "--model", model, "--no-session-persistence", "--tools", "", "--disable-slash-commands", "--strict-mcp-config", "-"],
      "r+", err: [:child, :out]
    ) do |io|
      io.write(prompt)
      io.close_write
      io.read
    end

    [$?.success? && !output.strip.empty?, output.strip]
  end

  # Strip wrapping code fences from AI output.
  def self.strip_code_fences(text)
    text.sub(/\A```[^\n]*\n/, "").sub(/\n```\z/, "").strip
  end

  # Wrap text to a given width.
  def self.wrap(text, width = 72)
    text.gsub(/(.{1,#{width}})(\s+|\z)/, "\\1\n").rstrip
  end
end
