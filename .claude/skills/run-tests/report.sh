#!/usr/bin/env bash
# report.sh - turn a test run's log into the tables /run-tests reports.
#
# Why this exists: the sitrep and results tables were rebuilt by hand from
# ad-hoc greps every run, so they came out with different columns, different
# rounding, and occasionally a pass count read from a truncated log with the
# failure count scrolled off above it. One parser, one shape, every run.
#
# Nothing here is project-specific. It reads Playwright's `--reporter=line`
# output and Jest's default output, both auto-detected. Copying it to another
# repo needs no edits.
#
# Usage:
#   report.sh sitrep <log> <start-epoch>            one progress table
#   report.sh watch  <log> <start-epoch> [interval] a table every <interval>s
#                                                   (default 180) until the run
#                                                   ends; feed it to Monitor
#   report.sh final  <label> <log> [start-epoch]    results row + failure rows
#   report.sh arm    <log> <start-epoch>            show it on the status line
#   report.sh disarm                                stop showing it
#
# Optional: RUN_TESTS_SLOW_SPECS="a.spec.js b.spec.js" annotates the estimate
# when one of those is in flight, because they make it read long.

set -uo pipefail

die() { echo "report.sh: $*" >&2; exit 2; }

# Playwright colourises even when redirected, and the app under test writes its
# own logs into the same file. Strip escapes before matching anything.
strip_ansi() { sed -E $'s/\x1b\\[[0-9;]*[A-Za-z]//g' "$1"; }

# A 24-cell bar. Terminals render these block glyphs at a consistent width, and
# the numbers stay beside it - the bar is for the glance, not the reading.
bar() { # <done> <total> [width]
  local d=$1 t=$2 w=${3:-24} filled
  (( t > 0 )) || { printf '%*s' "$w" '' | tr ' ' '.'; return; }
  filled=$(( d * w / t ))
  # sed, not tr: tr is byte-oriented and cannot emit a multibyte glyph.
  printf '%s%s %d%%' \
    "$(printf '%*s' "$filled" '' | sed 's/ /\xe2\x96\x88/g')" \
    "$(printf '%*s' "$((w - filled))" '' | sed 's/ /\xe2\x96\x91/g')" \
    "$(( d * 100 / t ))"
}

fmt_dur() { # seconds -> 3m / 1h 04m / 42s
  local s=$1
  if   (( s < 60 ));   then echo "${s}s"
  elif (( s < 3600 )); then echo "$((s / 60))m"
  else printf '%dh %02dm\n' $((s / 3600)) $(((s % 3600) / 60))
  fi
}

# ---------------------------------------------------------------- reading ---

# Anchored on the runner's own numbered failure lines. Matching the word
# "failed" instead catches it inside TEST NAMES and cries wolf.
count_failures() { grep -cE '^[[:space:]]*[0-9]+\) \[' "$1"; }

progress() { grep -oE '^\[[0-9]+/[0-9]+\]' "$1" | tail -1 | tr -d '[]'; }

current_spec() {
  grep -E '^\[[0-9]+/[0-9]+\]' "$1" | tail -1 |
    grep -oE '[A-Za-z0-9._-]+\.(spec|test)\.[cm]?[jt]s' | tail -1
}

# A run is over when ITS OWN log carries a summary line in the tail AND that
# log has stopped growing. This used to ask `pgrep` whether ANY playwright or
# jest process was alive anywhere on the machine, which is wrong the moment two
# tiers run back to back: the FINISHED watch sees the NEXT tier's process, so it
# never exits, keeps emitting stale 100% sitreps until it times out - and then
# its EXIT trap disarms the status line belonging to the run actually in flight.
# Both halves of that happened on 2026-08-28, during a guard set followed by a
# full suite. Everything here is scoped to one log, so a second run cannot be
# mistaken for this one.
#
# The tail window matters on its own: a tier that runs unit tests and then e2e
# into one log holds a jest summary hundreds of lines above the real end, and
# testing the whole file would call the run finished while it was still going.
# The growth check is what covers the moment that jest summary IS the tail.
run_finished() {
  local log=$1 a b
  tail -n 5 "$log" | grep -qE '^[[:space:]]*[0-9]+ (passed|failed)|^Tests:' || return 1
  a=$(wc -c < "$log" 2>/dev/null || echo 0)
  sleep 2
  b=$(wc -c < "$log" 2>/dev/null || echo 0)
  [[ $a == "$b" ]]
}

# ----------------------------------------------------------------- sitrep ---

sitrep() {
  local log=$1 start=$2 clean
  clean=$(mktemp); strip_ansi "$log" > "$clean"

  local prog done_n total_n fails now elapsed est
  prog=$(progress "$clean")
  done_n=${prog%%/*}; total_n=${prog##*/}
  fails=$(count_failures "$clean")
  now=$(current_spec "$clean")
  elapsed=$(( $(date +%s) - start ))

  if [[ -n ${done_n:-} && ${done_n:-0} -gt 0 ]]; then
    est=$(fmt_dur $(( elapsed * (total_n - done_n) / done_n )))
    # An estimate from a handful of tests is mostly noise; say so rather than
    # printing a confident number.
    (( done_n * 10 < total_n )) && est="~$est (early - unreliable)" || est="~$est"
    for s in ${RUN_TESTS_SLOW_SPECS:-}; do
      [[ $now == "$s" ]] && est="$est, running slow spec $s"
    done
  else
    est="unknown - no test has completed yet"
  fi

  printf '| | |\n|---|---|\n'
  printf '| **Progress** | `%s` %s |\n' \
    "$(bar "${done_n:-0}" "${total_n:-0}")" "${prog:-not started}"
  printf '| **Failures** | %s |\n' "$fails"
  printf '| **Now running** | `%s` |\n' "${now:-?}"
  printf '| **Elapsed** | %s |\n' "$(fmt_dur "$elapsed")"
  printf '| **Est. remaining** | %s |\n' "$est"
  rm -f "$clean"
}

# The status line reads this pointer; no pointer, no extra line. See
# statusline.sh, which is deliberately silent when nothing is armed.
POINTER="$HOME/.claude/run-tests-current"
arm()    { printf '%s\t%s\n' "$1" "$2" > "$POINTER"; }
disarm() { rm -f "$POINTER"; }

# Disarm ONLY if the pointer still names the run this watch armed. Watches can
# overlap - one tier finishing while the next is already running - and an
# unconditional rm in the exit trap means the FIRST watch silently disarms the
# SECOND one's status line on its way out. That is not hypothetical: it blanked
# a live full-suite status line on 2026-08-28. The explicit `disarm` subcommand
# stays unconditional, because a human asking for it means ALL of it.
disarm_mine() {
  [[ -f $POINTER ]] || return 0
  local cur
  IFS=$'\t' read -r cur _ < "$POINTER"
  [[ $cur == "${MY_LOG:-}" ]] && rm -f "$POINTER"
  return 0
}

watch_run() {
  local log=$1 start=$2 interval=${3:-180}
  arm "$log" "$start"
  MY_LOG=$log
  # Disarm however this exits - a stale pointer would leave the status line
  # reporting a finished run for the rest of the session - but only if the
  # pointer is still OURS. See disarm_mine.
  trap disarm_mine EXIT INT TERM
  while true; do
    sleep "$interval"
    [[ -f $log ]] || { echo "waiting for $log"; continue; }
    sitrep "$log" "$start"
    if run_finished "$log"; then echo "RUN FINISHED"; disarm_mine; return 0; fi
  done
}

# ------------------------------------------------------------------ final ---

# "N passed, N failed, N skipped" in one stable order, whichever runner wrote it.
summarise() {
  local clean=$1 out="" n
  # LAST summary wins. A tier that runs unit tests and then e2e into one log
  # holds both, and testing for jest first reported a 134-test playwright run
  # as "42 passed" - the jest total, sitting 280 lines above the real one.
  if [[ $(grep -nE '^Tests:|^[[:space:]]*[0-9]+ passed' "$clean" | tail -1) == *Tests:* ]]; then
    sed -nE 's/^Tests:[[:space:]]+(.*)$/\1/p' "$clean" | tail -1 |
      sed -E 's/,?[[:space:]]*[0-9]+ total//'
    return
  fi
  # "did not run" matters as much as "failed": a serial describe abandons the
  # rest of its cases after one fails, and a summary that omitted them would
  # report a truncated run as a complete one.
  for k in passed failed flaky skipped "did not run"; do   # playwright
    n=$(grep -oE "^[[:space:]]*[0-9]+ $k" "$clean" | tail -1 | grep -oE '[0-9]+')
    [[ -n $n && $n != 0 ]] && out+="${out:+, }$n $k"
  done
  # A run that produced no summary at all did not finish - never call that green.
  echo "${out:-no summary line - run did not complete}"
}

duration() {
  local clean=$1 start=${2:-} d
  d=$(grep -oE '^[[:space:]]*[0-9]+ passed \([^)]+\)' "$clean" | tail -1 |
      grep -oE '\([^)]+\)' | tr -d '()')
  [[ -z $d ]] && d=$(sed -nE 's/^Time:[[:space:]]+(.*)$/\1/p' "$clean" | tail -1)
  [[ -z $d && -n $start ]] && d="$(fmt_dur $(( $(date +%s) - start ))) (wall clock)"
  echo "${d:-?}"
}

# One row per failure. The VERDICT is left blank on purpose: whether a failure
# is the change in hand or a stale spec is a judgement made by re-running it on
# a clean tree, and a script that guessed would be guessing in the one column
# that matters.
failure_rows() {
  local clean=$1
  awk '
    /^[[:space:]]*[0-9]+\) \[/ {
      spec = ""; msg = ""
      if (match($0, /[A-Za-z0-9._\/-]+\.(spec|test)\.[cm]?[jt]s:[0-9]+:[0-9]+/))
        spec = substr($0, RSTART, RLENGTH)
      capture = 1; next
    }
    capture && NF {
      line = $0
      sub(/^[[:space:]]+/, "", line)
      if (line ~ /^[-─=]+$/) next
      gsub(/\|/, "\\|", line)
      if (length(line) > 100) line = substr(line, 1, 97) "..."
      sub(/.*\//, "", spec)
      printf "| `%s` | %s |  |\n", (spec ? spec : "?"), line
      capture = 0
    }
  ' "$clean"
}

final() {
  local label=$1 log=$2 start=${3:-} clean
  [[ -f $log ]] || die "no such log: $log"
  clean=$(mktemp); strip_ansi "$log" > "$clean"

  printf '| Tier | Result | Time |\n|---|---|---|\n'
  printf '| %s | %s | %s |\n' "$label" "$(summarise "$clean")" "$(duration "$clean" "$start")"

  local rows; rows=$(failure_rows "$clean")
  if [[ -n $rows ]]; then
    printf '\n| Spec | Error | Verdict |\n|---|---|---|\n%s\n' "$rows"
    printf '\nVerdicts are blank by design - re-run each on a clean tree before attributing it.\n'
  fi
  rm -f "$clean"
}

# ------------------------------------------------------------------- main ---

case ${1:-} in
  sitrep) [[ $# -ge 3 ]] || die "usage: sitrep <log> <start-epoch>"; sitrep "$2" "$3" ;;
  watch)  [[ $# -ge 3 ]] || die "usage: watch <log> <start-epoch> [interval]"; watch_run "$2" "$3" "${4:-180}" ;;
  arm)    [[ $# -ge 3 ]] || die "usage: arm <log> <start-epoch>"; arm "$2" "$3" ;;
  disarm) disarm ;;
  final)  [[ $# -ge 3 ]] || die "usage: final <label> <log> [start-epoch]"; final "$2" "$3" "${4:-}" ;;
  *) die "usage: report.sh {sitrep|watch|final|arm|disarm} ..." ;;
esac
