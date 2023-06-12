#!/bin/bash

# Ensure directory exists
if [ ! -d "./build/" ]; then
    mkdir build/
fi

# Copy index.html
cp src/index.html build/

# Copy css/
cp -a src/css/ build/

# Copy fonts/
cp -a src/fonts/ build/