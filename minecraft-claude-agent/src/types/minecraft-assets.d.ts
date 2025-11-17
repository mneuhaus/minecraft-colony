declare module 'minecraft-assets' {
  interface TextureData {
    texture: string | null;
  }

  interface MinecraftAssets {
    textureContent: Record<string, TextureData>;
    blocks: Record<string, any>;
    blocksArray: any[];
    directory?: string;
    version: string;
    getTexture(name: string): string;
    findItemOrBlockByName(name: string): any;
    getImageContent(name: string): string | null;
  }

  function mcAssets(version: string): MinecraftAssets;
  export = mcAssets;
}
