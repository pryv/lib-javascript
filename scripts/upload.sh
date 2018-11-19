#!/bin/sh

set -e

# working dir fix
scriptsFolder=$(cd $(dirname "$0"); pwd)
cd $scriptsFolder/..

if [ $# -eq 0 ]
  then
  echo "No commit message was provided, please provide a message as argument for readability";
  exit 1;
fi

cd dist && git add . && git add -u . && git commit -m "$1" && git push