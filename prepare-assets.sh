#!/bin/bash

# Ensure directory exists
mkdir -p build/

# Copy index.html
cp src/index.html build/

# Copy css/
cp -a src/css/ build/

# Copy fonts/
cp -a src/fonts/ build/
