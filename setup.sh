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

# Check Node.js (cannot auto-install — user must have it)
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -ge 22 ]; then
    echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"
  else
    echo -e "  ${RED}✗${NC} Node.js $(node -v) found, but v22+ is required."
    echo -e "      Update via: ${BLUE}nvm install 22${NC}  or  ${BLUE}https://nodejs.org${NC}"
    exit 1
  fi
else
  echo -e "  ${RED}✗${NC} Node.js not found. Install v22+ first:"
  echo -e "      Option 1: ${BLUE}curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash && nvm install 22${NC}"
  echo -e "      Option 2: ${BLUE}https://nodejs.org${NC}"
  exit 1
fi

# Check pnpm (auto-install if missing)
if command -v pnpm &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} pnpm $(pnpm -v)"
else
  echo -e "  ${YELLOW}⚠${NC} pnpm not found — installing..."
  npm install -g pnpm@latest
  echo -e "  ${GREEN}✓${NC} pnpm $(pnpm -v) installed"
fi

# Check Claude Code CLI (auto-install if missing)
if command -v claude &> /dev/null; then
  CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "unknown")
  echo -e "  ${GREEN}✓${NC} Claude Code CLI ($CLAUDE_VERSION)"
else
  echo -e "  ${YELLOW}⚠${NC} Claude Code CLI not found — installing..."
  npm install -g @anthropic-ai/claude-code
  if command -v claude &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Claude Code CLI installed"
    echo -e "      ${YELLOW}→ Run ${BLUE}claude${YELLOW} once after setup to authenticate${NC}"
  else
    echo -e "  ${YELLOW}⚠${NC} Could not install Claude Code CLI automatically"
    echo -e "      Install manually: ${BLUE}npm install -g @anthropic-ai/claude-code${NC}"
    echo -e "      (Required for agent execution, UI will work without it)"
  fi
fi

echo ""

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pnpm install

# Build
echo -e "${BLUE}Building packages...${NC}"
pnpm build

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo -e "  Start the app:"
echo -e "  ${BLUE}pnpm start${NC}"
echo ""
echo -e "  Then open ${BLUE}http://localhost:4173${NC}"
echo ""
