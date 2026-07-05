import languages from './language.json'

export type Language = {
  code: string
  name: string
  native: string
  rtl?: number
}

const languageList = languages as Language[]

export function getLanguageCode(value: string | null | undefined) {
  const language = value?.trim().toLowerCase()
  if (!language) return ''
  return languageList.find((item) => item.code.toLowerCase() === language || item.name.toLowerCase() === language || item.native.toLowerCase() === language)?.code ?? ''
}

export function formatLanguage(value: string | null | undefined) {
  const code = getLanguageCode(value)
  const language = languageList.find((item) => item.code === code)
  if (!language) return value || ''
  return language.native === language.name ? language.name : `${language.name} (${language.native})`
}

export { languageList as languages }
