import { Archivo } from "next/font/google";

// Archivo: grotesca de largura variável. Corpo na largura normal; títulos na
// versão larga e pesada (utilitário `heading` em globals.css), como letra de placa.
// Fica aqui para o layout raiz e a tela de erro global (que o substitui) usarem.
export const archivo = Archivo({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
});
