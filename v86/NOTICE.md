# v86 assets

`libv86.js`, `v86.wasm`, and `v86.css` are from [copy/v86](https://github.com/copy/v86) and are
distributed under the BSD-2-Clause license in `LICENSE`.

`seabios.bin` and `vgabios.bin` are the firmware images from the same v86 distribution. SeaBIOS
and VGABIOS are covered by the GNU Lesser General Public License; see `COPYING.LESSER`.

The Android-x86 4.4-r1 image itself is not bundled here. `android.html` range-reads it from
the Internet Archive through the site's `/api/android-image/` proxy, in 1 MB chunks.
Android-x86 is an independent open-source project.
