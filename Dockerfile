# Base image with Playwright pre-installed
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Install Xvfb for headed mode in container
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create directories
RUN mkdir -p screenshots data/cookies

# Environment variables
ENV DISPLAY=:99
ENV NODE_ENV=production

# Copy and set up entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose VNC port for debugging (optional)
EXPOSE 5900

# Run the MCP server
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "start"]
