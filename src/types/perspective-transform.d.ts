declare module "perspective-transform" {
  type TransformResult = [number, number];

  type PerspectiveTransformer = {
    transform: (x: number, y: number) => TransformResult;
    transformInverse: (x: number, y: number) => TransformResult;
  };

  export default function PerspT(
    srcPts: number[],
    dstPts: number[],
  ): PerspectiveTransformer;
}
