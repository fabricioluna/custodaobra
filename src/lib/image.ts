/**
 * Reduz uma foto no próprio aparelho antes de enviar: lado maior de até
 * 1600 px, em JPEG. Uma foto de celular de 4 MB vira algo como 300 KB, o que
 * economiza dados no canteiro e cabe no limite de envio. Se o navegador não
 * conseguir abrir o formato (HEIC no Chrome, por exemplo), devolve o original.
 * Só roda no navegador.
 */
export async function shrinkImage(
  file: File,
  { maxSide = 1600, quality = 0.8 } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "comprovante";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
