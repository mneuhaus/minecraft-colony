declare module 'minecraft-assets' {
  interface TextureData {
    texture: Buffer | Uint8Array;
  }

  interface MinecraftAssets {
    textureContent: {
      [key: string]: TextureData;
    };
    getTexture(itemName: string): string;
  }

  function mcAssets(version: string): MinecraftAssets;
  export = mcAssets;
}
