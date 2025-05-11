# Use Node.js LTS version as the base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Create dist directory if it doesn't exist
RUN mkdir -p dist

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"] 