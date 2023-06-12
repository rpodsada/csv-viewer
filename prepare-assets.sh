#!/bin/bash

# Ensure directories exist
mkdir -p build/
mkdir -p build/css/
mkdir -p build/fonts/

# Copy index.html
cp src/index.html build/

# Copy css/
cp -r src/css/* build/css/

# Copy fonts/
cp -r src/fonts/* build/fonts/
