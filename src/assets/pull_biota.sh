apt-get -y install zip unzip
PROD_BIOTA_DIR=$1

if [[ "$all_vars" == *" --up-biota"* ]]; then
  echo "Removing biota mariadb ..."
  rm -rf "${PROD_BIOTA_DIR}/mariadb"
  all_vars="${all_vars//--up-biota/}"
fi

echo "Pulling biota mariadb ..."
if [[ ! -d "$PROD_BIOTA_DIR" ]]; then
  mkdir -p "$PROD_BIOTA_DIR"
fi


if [[ ! -d "${PROD_BIOTA_DIR}/mariadb" ]]; then
  curl $BIOTA_MARIA_DB_URL -o "${PROD_BIOTA_DIR}/mariadb.zip"
  echo "Decompressing biota mariadb ..."
  unzip -q "${PROD_BIOTA_DIR}/mariadb.zip" -d "${PROD_BIOTA_DIR}"
  rm -f "${PROD_BIOTA_DIR}/mariadb.zip"
fi


if [[ -d "${PROD_BIOTA_DIR}/mariadb" ]] ; then
  export GWS_ENV_INSTALLED=1
else
  export GWS_ENV_INSTALLED=0
fi
