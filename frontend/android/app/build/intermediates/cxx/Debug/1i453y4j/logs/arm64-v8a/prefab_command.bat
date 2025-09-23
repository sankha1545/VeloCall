@echo off
"C:\\Program Files\\Java\\jdk-17\\bin\\java" ^
  --class-path ^
  "C:\\Users\\SANKHA SUBHRA\\.gradle\\caches\\modules-2\\files-2.1\\com.google.prefab\\cli\\2.1.0\\aa32fec809c44fa531f01dcfb739b5b3304d3050\\cli-2.1.0-all.jar" ^
  com.google.prefab.cli.AppKt ^
  --build-system ^
  cmake ^
  --platform ^
  android ^
  --abi ^
  arm64-v8a ^
  --os-version ^
  24 ^
  --stl ^
  c++_shared ^
  --ndk-version ^
  27 ^
  --output ^
  "C:\\Users\\SANKHA~1\\AppData\\Local\\Temp\\agp-prefab-staging5993728057665519437\\staged-cli-output" ^
  "C:\\Users\\SANKHA SUBHRA\\.gradle\\caches\\8.13\\transforms\\a89efe01639eb7dad7f1852c2dc2010d\\transformed\\react-android-0.79.5-debug\\prefab" ^
  "E:\\Apploication\\frontend\\android\\app\\build\\intermediates\\cxx\\refs\\react-native-reanimated\\4v245l1d" ^
  "C:\\Users\\SANKHA SUBHRA\\.gradle\\caches\\8.13\\transforms\\8b58fa16b3b4fa0649400855afae7a3f\\transformed\\hermes-android-0.79.5-debug\\prefab" ^
  "C:\\Users\\SANKHA SUBHRA\\.gradle\\caches\\8.13\\transforms\\d6e46b19b602d3371982eebc7ed690ed\\transformed\\fbjni-0.7.0\\prefab"
