# Use a lightweight Node.js image
FROM node:20-slim

# Set working directory
WORKDIR /src

# Set environment variable to skip downloading prebuilt workers
ENV MEDIASOUP_SKIP_WORKER_PREBUILT_DOWNLOAD="true"

# Install necessary system packages and dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        python3 \
        python3-pip \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and install npm dependencies
# Use --ignore-scripts to skip ngrok's postinstall binary download (not needed in production)
# Then rebuild mediasoup separately so its C++ worker gets compiled from source
COPY package.json .
RUN npm install --ignore-scripts && npm rebuild mediasoup

# Cleanup unnecessary packages and files
RUN apt-get purge -y --auto-remove build-essential python3-pip \
&& npm cache clean --force \
&& rm -rf /tmp/* /var/tmp/* /usr/share/doc/*

# Copy the application code
COPY app app
COPY public public

# Set default command to start the application
CMD ["npm", "start"]
