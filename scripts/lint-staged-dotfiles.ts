#!/usr/bin/env zx

import { classifyFiles, lintGroups } from "./dotfiles-tools.ts";

await lintGroups(classifyFiles(process.argv.slice(3)));
