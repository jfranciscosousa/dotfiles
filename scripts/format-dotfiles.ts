#!/usr/bin/env zx

import { classifyFiles, discoverSourceFiles, formatGroups } from "./dotfiles-tools.ts";

await formatGroups(classifyFiles(discoverSourceFiles()));
