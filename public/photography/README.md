# Photography

Original photographs live here as `1.jpg` through `9.jpg` and are preserved unchanged.

`web/` contains 1200px and 2400px JPEG copies for responsive loading. The gallery uses
these copies, preserving each photograph's complete aspect ratio. The enlarged viewer
uses the 2400px version.

The ordered descriptions and dimensions are in `photography` in `src/data.js`.
To add a photograph, add its original, generate matching web copies, and extend that
list with its description and dimensions. Rebuild and publish after changes.

Generate a copy on macOS (replace the number for each photo):

```sh
sips -Z 2400 -s formatOptions 85 1.jpg --out web/1-2400.jpg
sips -Z 1200 -s formatOptions 82 1.jpg --out web/1-1200.jpg
```
