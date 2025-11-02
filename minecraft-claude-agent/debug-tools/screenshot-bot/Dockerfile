FROM node:18-bullseye

RUN apt-get update -y
RUN apt-get install -y xserver-xorg-dev libxi-dev libxext-dev xvfb libglu1-mesa-dev libxi6 libxmu6 libxrender1 \
    python3 python3-pip make g++ pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
RUN ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /usr/src/app

COPY package.json ./

RUN npm install

COPY screenshot.js ./

RUN mkdir screenshots

# Start the container with the BrowserCubeMap example script
CMD xvfb-run --auto-servernum --server-num=1 --server-args='-ac -screen 0 1280x1024x24' node screenshot.js $HOST $PORT $USERNAME $PASSWORD
