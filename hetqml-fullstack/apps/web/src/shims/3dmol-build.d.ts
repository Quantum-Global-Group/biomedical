/** Shim: 3dmol ships `build/3Dmol.js` without a subpath types export. */
declare module "3dmol/build/3Dmol.js" {
  const $3Dmol: unknown;
  export default $3Dmol;
}
