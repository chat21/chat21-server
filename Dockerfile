FROM node:22-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install --production

# Bundle app source
COPY . .

# Environment variables
ENV NODE_ENV=production

CMD [ "node", "src/chatservermq.js" ]
