export interface StartComposeRequestDTO {
  composeContent: string;
  options?: StartComposeRequestOptionsDTO;
}

export interface StartComposeRequestOptionsDTO {
  description?: string;
}
