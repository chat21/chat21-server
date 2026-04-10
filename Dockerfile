FROM node:16

# Create app directory
WORKDIR /usr/src/app

# Install all dependencies (including devDependencies needed to compile TypeScript)
COPY package*.json ./
RUN npm install

# Bundle app source and compile TypeScript
COPY . .
RUN npm run build

CMD [ "node", "dist/chatservermq.js" ]
