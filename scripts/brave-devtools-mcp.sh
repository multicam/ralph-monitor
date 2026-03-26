#!/usr/bin/env bash
# Cross-platform wrapper: finds Brave and launches chrome-devtools-mcp

case "$(uname -s)" in
  Darwin) BRAVE="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" ;;
  Linux)  BRAVE="$(command -v brave-browser 2>/dev/null || echo /usr/bin/brave-browser)" ;;
  MINGW*|MSYS*|CYGWIN*) BRAVE="$(command -v brave.exe 2>/dev/null || echo "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe")" ;;
  *)      echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

if [ ! -x "$BRAVE" ] && [ ! -f "$BRAVE" ]; then
  echo "Brave not found at $BRAVE" >&2
  exit 1
fi

exec npx -y chrome-devtools-mcp --executablePath "$BRAVE" "$@"
