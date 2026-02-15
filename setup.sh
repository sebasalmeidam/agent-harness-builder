#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏗️  Agent Harness Builder — Setup${NC}"
echo ""

ERRORS=0

# Check Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -ge 22 ]; then
    echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"
  else
    echo -e "  ${RED}✗${NC} Node.js $(node -v) — requires v22+"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "  ${RED}✗${NC} Node.js not found — install from https://nodejs.org"
  ERRORS=$((ERRORS + 1))
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} pnpm $(pnpm -v)"
else
  echo -e "  ${YELLOW}⚠${NC} pnpm not found — installing..."
  npm install -g pnpm@latest
  if command -v pnpm &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} pnpm $(pnpm -v) installed"
  else
    echo -e "  ${RED}✗${NC} Failed to install pnpm"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check Claude Code CLI
if command -v claude &> /dev/null; then
  CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "unknown")
  echo -e "  ${GREEN}✓${NC} Claude Code CLI ($CLAUDE_VERSION)"
else
  echo -e "  ${YELLOW}⚠${NC} Claude Code CLI not found"
  echo -e "      Install: ${BLUE}npm install -g @anthropic-ai/claude-code${NC}"
  echo -e "      Then run ${BLUE}claude${NC} once to authenticate"
  echo -e "      (Required for agent execution, not for UI)"
fi

echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}✗ $ERRORS required dependency missing. Fix the above and re-run.${NC}"
  exit 1
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pnpm install

# Build
echo -e "${BLUE}Building packages...${NC}"
pnpm build

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo -e "  Start development server:"
echo -e "  ${BLUE}pnpm dev${NC}"
echo ""
echo -e "  Then open ${BLUE}http://localhost:4173${NC}"
echo ""
