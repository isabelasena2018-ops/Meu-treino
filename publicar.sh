#!/bin/sh
# Gera o version.json a partir do APP_VERSION do index.html (o app usa pra se atualizar sozinho)
v=$(grep -o "const APP_VERSION='[^']*'" index.html | sed "s/const APP_VERSION='//; s/'$//")
printf '{"v":"%s"}\n' "$v" > version.json
echo "version.json -> $v"
