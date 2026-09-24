export interface NativeFiles {
 share: (data: {files: File[]; text?: string; title?: string}) => Promise<void>;
}
declare global { interface Window { diamondNativeFiles?: NativeFiles } }
export async function saveGameFile(file: File): Promise<void> {
 if (window.diamondNativeFiles) return window.diamondNativeFiles.share({files:[file],title:file.name});
 const url=URL.createObjectURL(file),a=document.createElement('a');
 a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
