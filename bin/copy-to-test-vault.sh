#!/bin/bash

# Copy plugin files to test vault
PLUGIN_DIR="test-vault/.obsidian/plugins/rdf-tools"

# Create the plugin directory if it doesn't exist
mkdir -p "$PLUGIN_DIR"

# Copy the required files
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"

# Copy styles.css if it exists
if [ -f "styles.css" ]; then
    cp styles.css "$PLUGIN_DIR/"
fi

echo "Plugin files copied to $PLUGIN_DIR"