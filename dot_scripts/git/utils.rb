# frozen_string_literal: true

# Shared utilities for git-* Ruby scripts.
# Usage: require_relative 'utils'

require 'English'

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
  # Defaults to "opencode/big-pickle".
  def ai_generate(prompt, model: nil, provider: :claude)
    case provider
    when :claude
      ai_generate_claude(prompt, model: model || "haiku")
    when :opencode
      ai_generate_opencode(prompt, model: model || "opencode/big-pickle")
    else
      raise ArgumentError, "Unknown provider: #{provider}"
    end
  end

  private

  def ai_generate_claude(prompt, model:)
    output = IO.popen(
      ["claude", "--print", "--model", model, "--no-session-persistence", "--tools", "", "--disable-slash-commands", "--strict-mcp-config", "-"],
      "r+", err: %i[child out]
    ) do |io|
      io.write(prompt)
      io.close_write
      io.read
    end

    [$CHILD_STATUS.success? && !output.strip.empty?, output.strip]
  end

  def ai_generate_opencode(prompt, model:)
    cmd = %w[opencode run]
    cmd += ["--model", model] if model
    cmd << prompt

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
end
