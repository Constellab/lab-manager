sudo apt-get -y install zip unzip
PROD_BIOTA_DIR="$1/prod/data/gws_biota"
DEV_BIOTA_DIR="$1/dev/data/gws_biota"

if [[ "$all_vars" == *" --up-biota"* ]]; then
  echo "Removing biota mariadb ..."
  sudo rm -rf "${PROD_BIOTA_DIR}/mariadb"
  sudo rm -rf "${DEV_BIOTA_DIR}/mariadb"
  all_vars="${all_vars//--up-biota/}"
fi

echo "Pulling biota mariadb ..."
if [[ ! -d "$PROD_BIOTA_DIR" ]]; then
  sudo mkdir -p "$PROD_BIOTA_DIR"
fi
if [[ ! -d "$DEV_BIOTA_DIR" ]]; then
  sudo mkdir -p "$DEV_BIOTA_DIR"
fi
if [[ ! -d "${PROD_BIOTA_DIR}/mariadb" ]]; then
  sudo curl $BIOTA_MARIA_DB_URL -o "${PROD_BIOTA_DIR}/mariadb.zip"
  echo "Decompressing biota mariadb ..."
  sudo unzip -q "${PROD_BIOTA_DIR}/mariadb.zip" -d "${PROD_BIOTA_DIR}"
  sudo rm -f "${PROD_BIOTA_DIR}/mariadb.zip"
fi
if [[ ! -d "${DEV_BIOTA_DIR}/mariadb" ]]; then
  sudo cp -R "${PROD_BIOTA_DIR}/mariadb" "${DEV_BIOTA_DIR}/mariadb"
fi

if [[ -d "${PROD_BIOTA_DIR}/mariadb" ]] && [[ -d "${DEV_BIOTA_DIR}/mariadb" ]]; then
  export GWS_ENV_INSTALLED=1
else
  export GWS_ENV_INSTALLED=0
fi
