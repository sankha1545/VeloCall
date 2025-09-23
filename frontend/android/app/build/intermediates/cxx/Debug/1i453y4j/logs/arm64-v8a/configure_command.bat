@echo off
"C:\\Users\\SANKHA SUBHRA\\AppData\\Local\\Android\\Sdk\\cmake\\3.22.1\\bin\\cmake.exe" ^
  "-HE:\\Apploication\\frontend\\node_modules\\react-native\\ReactAndroid\\cmake-utils\\default-app-setup" ^
  "-DCMAKE_SYSTEM_NAME=Android" ^
  "-DCMAKE_EXPORT_COMPILE_COMMANDS=ON" ^
  "-DCMAKE_SYSTEM_VERSION=24" ^
  "-DANDROID_PLATFORM=android-24" ^
  "-DANDROID_ABI=arm64-v8a" ^
  "-DCMAKE_ANDROID_ARCH_ABI=arm64-v8a" ^
  "-DANDROID_NDK=C:\\Users\\SANKHA SUBHRA\\AppData\\Local\\Android\\Sdk\\ndk\\27.1.12297006" ^
  "-DCMAKE_ANDROID_NDK=C:\\Users\\SANKHA SUBHRA\\AppData\\Local\\Android\\Sdk\\ndk\\27.1.12297006" ^
  "-DCMAKE_TOOLCHAIN_FILE=C:\\Users\\SANKHA SUBHRA\\AppData\\Local\\Android\\Sdk\\ndk\\27.1.12297006\\build\\cmake\\android.toolchain.cmake" ^
  "-DCMAKE_MAKE_PROGRAM=C:\\Users\\SANKHA SUBHRA\\AppData\\Local\\Android\\Sdk\\cmake\\3.22.1\\bin\\ninja.exe" ^
  "-DCMAKE_LIBRARY_OUTPUT_DIRECTORY=E:\\Apploication\\frontend\\android\\app\\build\\intermediates\\cxx\\Debug\\1i453y4j\\obj\\arm64-v8a" ^
  "-DCMAKE_RUNTIME_OUTPUT_DIRECTORY=E:\\Apploication\\frontend\\android\\app\\build\\intermediates\\cxx\\Debug\\1i453y4j\\obj\\arm64-v8a" ^
  "-DCMAKE_BUILD_TYPE=Debug" ^
  "-DCMAKE_FIND_ROOT_PATH=E:\\Apploication\\frontend\\android\\app\\.cxx\\Debug\\1i453y4j\\prefab\\arm64-v8a\\prefab" ^
  "-BE:\\Apploication\\frontend\\android\\app\\.cxx\\Debug\\1i453y4j\\arm64-v8a" ^
  -GNinja ^
  "-DPROJECT_BUILD_DIR=E:\\Apploication\\frontend\\android\\app\\build" ^
  "-DPROJECT_ROOT_DIR=E:\\Apploication\\frontend\\android" ^
  "-DREACT_ANDROID_DIR=E:\\Apploication\\frontend\\node_modules\\react-native\\ReactAndroid" ^
  "-DANDROID_STL=c++_shared" ^
  "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"
