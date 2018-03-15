CURRENT_DIR=`dirname $0; pwd`

cd /tmp
curl -O https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz
tar xJvf ffmpeg-release-64bit-static.tar.xz

cd ffmpeg-3.4.2-64bit-static
cp ./ffmpeg $CURRENT_DIR/