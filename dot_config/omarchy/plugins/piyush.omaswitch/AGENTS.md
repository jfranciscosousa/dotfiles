# OmaSwitch maintenance

Apply these instructions whenever the user asks to update this plugin.

1. Read the currently pinned revision in `README.md`.
2. Fetch the remote repository into a temporary directory. Do not execute fetched code yet.
3. Compare the pinned revision with the proposed revision. Review all changed files and the complete
   runtime source, not only the commit message.
4. Perform a security review before copying files. Check for:
   - process execution and shell-command construction;
   - network access or data transmission;
   - file-system reads, writes, deletion, and traversal;
   - privilege escalation, services, package installation, and persistence;
   - D-Bus, sockets, clipboard, input capture, screen capture, and window-data access;
   - dynamic code loading, new dependencies, generated files, and binary content;
   - unsafe rendering or command construction from window titles and other client-controlled data.
5. Check the repository history, contributor and signature changes, release notes, open security
   reports, and the exact commit hash. Treat a tag or branch name as mutable.
6. Report material findings to the user. Do not vendor an update with unexplained high-risk behavior
   or an expanded permission scope without explicit confirmation.
7. After the static review passes, run only relevant tests and `omarchy plugin validate` from the
   temporary checkout. Do not run install scripts or unreviewed test code.
8. Copy only the required, reviewed runtime files and the upstream license into this directory. Do
   not add `.git`, screenshots, build artifacts, or unrelated development files.
9. Update the exact commit hash and version in `README.md`.
10. Run the repository-required checks on all changed files and summarize the security review.

Original repository: https://github.com/piyush97/omaswitch
