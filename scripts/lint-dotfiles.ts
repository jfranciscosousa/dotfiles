#!/usr/bin/env zx

import { classifyFiles, discoverSourceFiles, lintGroups } from "./dotfiles-tools.ts";

await lintGroups(classifyFiles(discoverSourceFiles()));
