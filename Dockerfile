# Stage 1: Build
FROM node:22-alpine AS build

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /usr/src/app

# Install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy compiled code from build stage
COPY --from=build /usr/src/app/dist ./dist

# Environment variables
ENV NODE_ENV=production

# Start the application
CMD [ "npm", "start" ]
