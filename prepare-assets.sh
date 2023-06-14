#!/bin/bash

# Ensure directories exist
mkdir -p build/app/css/ build/app/fonts/

# Copy index.html
cp src/app/index.html build/app/

# Copy css/
cp -r src/app/css/* build/app/css/

# Copy fonts/
cp -r src/app/fonts/* build/app/fonts/
