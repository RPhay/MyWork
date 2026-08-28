#!/usr/bin/env bash
# statusline.sh - append a live test-run line to the Claude Code status line.
#
#   tests ▏ priority-field.spec.js · 98/36 · 96/2 ████████████░░░░░ 73% · ~2m
#
# 98/36 is completed/REMAINING (not total), and 96/2 is successful/failed.
#
# It prints NOTHING when no run is armed, so the status line is byte-for-byte
# what it was before on every other day. That is the whole contract: a status
# line that grew a permanent empty row would be worse than no feature.
#
# It DELEGATES to whatever status line was already configured rather than
# replacing it - $RUN_TESTS_STATUSLINE_DELEGATE, else ~/.claude/statusline-command.sh
# - passing the payload through on stdin, because that script needs the JSON too.
#
# Armed by `report.sh watch` (and `report.sh arm <log> <start>`), which writes
# the pointer file this reads. Disarmed when the run ends.
#
# Colours follow the delegate's rule: bright foregrounds only, NO grey - both
# dim and "bright black" are unreadable on a black terminal.

POINTER="$HOME/.claude/run-tests-current"
SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

input=$(cat)

# --- the existing status line, untouched ------------------------------------
delegate=${RUN_TESTS_STATUSLINE_DELEGATE:-$HOME/.claude/statusline-command.sh}
existing=""
[[ -x $delegate || -f $delegate ]] && existing=$(printf '%s' "$input" | bash "$delegate" 2>/dev/null)
[[ -n $existing ]] && printf '%s' "$existing"
# Our line goes BELOW the existing one - but only prefix the newline when there
# was something above it, or a bare status line starts with a blank row.
NL=""; [[ -n $existing ]] && NL=$'\n'

RESET=$'\033[0m'; RED=$'\033[91m'; GREEN=$'\033[92m'
YELLOW=$'\033[93m'; BLUE=$'\033[94m'; CYAN=$'\033[96m'; WHITE=$'\033[97m'

# --- counting background agents ----------------------------------------------
# There is NO status field on disk to read: an agent's .meta.json is written
# once at spawn and never updated, and the harness records no per-agent
# completion marker in the parent transcript that can be keyed by agent id.
# What IS reliable is the shape of the agent's OWN transcript. A finished agent
# ends on an assistant message carrying only text - its final answer. A running
# one ends mid-flight: an assistant message with a tool_use still outstanding,
# or the user tool_result that answered it. Verified against a live agent on
# 2026-08-28: it read `user/[tool_result]` while working and flipped to
# `assistant/[text]` at the instant its completion notification arrived.
#
# Do NOT swap this for an mtime freshness check. An agent that is thinking or
# sitting in a long tool call has not written for a while and would read as
# finished, while one that just exited looks alive - wrong in both directions,
# which is the whole reason this reads structure instead of timestamps.
AGENT_CACHE_TTL=3

# The count is cached because this runs on EVERY status-line repaint and the
# scan spawns a python process. The TTL is what makes "accurate" affordable.
running_agents() {
  local sid cache now at val
  sid=$(printf '%s' "$input" |
        grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 |
        sed 's/.*"\([^"]*\)"$/\1/')
  [[ -n $sid ]] || { printf '0'; return 0; }

  cache="${TMPDIR:-/tmp}/run-tests-agents-${sid}"
  now=$(date +%s)
  if [[ -f $cache ]]; then
    IFS=$'\t' read -r at val < "$cache"
    if [[ $at =~ ^[0-9]+$ ]] && (( now - at < AGENT_CACHE_TTL )); then
      printf '%s' "${val:-0}"; return 0
    fi
  fi

  val=$(SID="$sid" python3 -c '
import json, os, glob, sys
sid = os.environ["SID"]
n = 0
for d in glob.glob(os.path.expanduser("~/.claude/projects/*/" + sid + "/subagents")):
    for f in os.listdir(d):
        if not f.endswith(".jsonl"):
            continue
        p = os.path.join(d, f)
        try:
            # Tail only - a transcript runs to megabytes and this is per repaint.
            with open(p, "rb") as fh:
                fh.seek(0, os.SEEK_END)
                size = fh.tell()
                fh.seek(max(0, size - 65536))
                buf = fh.read()
            lines = [l for l in buf.split(b"\n") if l.strip()]
            if not lines:
                n += 1          # spawned, nothing written yet -> running
                continue
            last = json.loads(lines[-1].decode("utf-8", "replace"))
        except Exception:
            continue            # unreadable or a half-written line -> do not guess
        msg = last.get("message") or {}
        c = msg.get("content")
        blocks = [b.get("type") for b in c if isinstance(b, dict)] if isinstance(c, list) else []
        finished = last.get("type") == "assistant" and "tool_use" not in blocks
        if not finished:
            n += 1
print(n)
' 2>/dev/null)

  [[ $val =~ ^[0-9]+$ ]] || val=0
  printf '%s\t%s\n' "$now" "$val" > "$cache" 2>/dev/null
  printf '%s' "$val"
}

# --- background agents -------------------------------------------------------
# Counted by running_agents (defined elsewhere); treat anything that isn't a
# plain non-negative integer as zero rather than letting it corrupt the line.
agents=$(running_agents 2>/dev/null)
[[ $agents =~ ^[0-9]+$ ]] || agents=0

agent_plain=""; agent_colored=""
agent_plain_prefix=""; agent_colored_prefix=""
if (( agents > 0 )); then
  agent_plain="⚡${agents}"
  agent_colored="${YELLOW}⚡${agents}${RESET}"
  # Trailing separator so this can be glued directly in front of "tests".
  agent_plain_prefix="${agent_plain} ▏ "
  agent_colored_prefix="${agent_colored} ${BLUE}▏${RESET} "
fi

# --- our line, only while a run is armed ------------------------------------
# A run being armed and agents being active are independent - either, both or
# neither may be true, and only "neither" prints nothing at all.
run_armed=0
if [[ -f $POINTER ]]; then
  IFS=$'\t' read -r log start < "$POINTER"
  [[ -n ${log:-} && -f $log ]] && run_armed=1
fi

if (( ! run_armed )); then
  [[ -n $agent_colored ]] && printf '%s%s' "$NL" "$agent_colored"
  exit 0
fi

# Terminal width. The status line payload does not carry it, and this process
# has no controlling terminal of its own, so ask /dev/tty and fall back rather
# than assuming 80 and wrapping the line on a wide window.
cols=${RUN_TESTS_STATUS_COLS:-}
[[ -z $cols ]] && cols=$( { tput cols; } 2>/dev/null </dev/tty )
[[ -z $cols ]] && cols=$( { stty size; } 2>/dev/null </dev/tty | cut -d' ' -f2 )
[[ -z $cols || $cols -lt 40 ]] && cols=100

# Only the tail is read for position - progress lines are appended, so the last
# one is near the end, and a full-suite log is hundreds of KB to scan otherwise.
tail_txt=$(tail -n 400 "$log" | sed -E $'s/\x1b\\[[0-9;]*[A-Za-z]//g')
prog=$(grep -oE '^\[[0-9]+/[0-9]+\]' <<<"$tail_txt" | tail -1 | tr -d '[]')
spec=$(grep -E '^\[[0-9]+/[0-9]+\]' <<<"$tail_txt" | tail -1 |
       grep -oE '[A-Za-z0-9._-]+\.(spec|test)\.[cm]?[jt]s' | tail -1)
fails=$(sed -E $'s/\x1b\\[[0-9;]*[A-Za-z]//g' "$log" | grep -cE '^[[:space:]]*[0-9]+\) \[')

done_n=${prog%%/*}; total_n=${prog##*/}
now=$(date +%s); elapsed=$(( now - ${start:-now} ))

if [[ -z $prog || ${done_n:-0} -eq 0 ]]; then
  printf '%s%s%stests%s %s▏%s %sstarting…%s' "$NL" "$agent_colored_prefix" "$CYAN" "$RESET" "$BLUE" "$RESET" "$WHITE" "$RESET"
  exit 0
fi

pct=$(( done_n * 100 / total_n ))
eta_s=$(( elapsed * (total_n - done_n) / done_n ))
eta=$(( (eta_s + 59) / 60 ))m
remaining=$(( total_n - done_n ))
passed=$(( done_n - fails ))

# Plain text first so the bar can be sized against the REAL visible width -
# measuring a string with escapes in it is how these lines end up wrapping.
# x/y is completed/REMAINING (not total), a/b is successful/failed - both
# read as "what's left" and "how it's going" rather than a raw running count.
# The ETA sits at the far RIGHT, past the percentage, so the eye lands on the
# spec and the count first and the estimate last - it is the least certain
# number on the line and reads as an aside rather than a fact.
left="${agent_plain_prefix}tests ▏ ${spec:-?} · ${done_n}/${remaining} · ${passed}/${fails}"
right=" ${pct}% · ~${eta}"
barw=$(( cols - ${#left} - ${#right} - 3 ))
(( barw < 8 )) && barw=8
filled=$(( done_n * barw / total_n ))

# Bright foregrounds only - no grey, no dim, both unreadable on a black
# terminal. Completed/successful are GREEN, remaining is CYAN, separators
# are BLUE, and failed is RED only when > 0 - a zero must not read as alarming.
bar_col=$GREEN
fail_col=$GREEN
(( fails > 0 )) && bar_col=$RED
(( fails > 0 )) && fail_col=$RED

bar_filled=$(printf '%*s' "$filled" '' | sed 's/ /\xe2\x96\x88/g')
bar_empty=$(printf '%*s' "$((barw - filled))" '' | sed 's/ /\xe2\x96\x91/g')

line="${agent_colored_prefix}${CYAN}tests${RESET} ${BLUE}▏${RESET} ${WHITE}${spec:-?}${RESET} ${BLUE}·${RESET} ${GREEN}${done_n}${RESET}${BLUE}/${RESET}${CYAN}${remaining}${RESET} ${BLUE}·${RESET} ${GREEN}${passed}${RESET}${BLUE}/${RESET}${fail_col}${fails}${RESET} ${bar_col}${bar_filled}${RESET}${BLUE}${bar_empty}${RESET} ${bar_col}${pct}%${RESET} ${BLUE}·${RESET} ${CYAN}~${eta}${RESET}"

printf '%s%s' "$NL" "$line"
