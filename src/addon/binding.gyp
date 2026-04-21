{
  "targets": [
    {
      "target_name": "everything_addon",
      "sources": [
        "src/everything_addon.cc"
      ],
      "include_dirs": [
        "node_modules/node-addon-api"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": "0"
        }
      }
    }
  ]
}
