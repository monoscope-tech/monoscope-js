#!/bin/bash

echo "Building all packages first..."
pnpm run -r build

echo -e "\n=== Running tests for all packages ===\n"

# Run tests for each package
for package in common express fastify adonis nextjs; do
  echo -e "\n>>> Testing @monoscopetech/$package"
  cd packages/$package
  
  if [ -f "jest.config.js" ]; then
    pnpm test --passWithNoTests
  else
    echo "No jest config found, skipping..."
  fi
  
  cd ../..
done

echo -e "\n=== All tests completed ===\n"