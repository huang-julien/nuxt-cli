import { promises as fsp } from 'fs'
import { relative, resolve } from 'upath'
import { cyan } from 'colorette'
import type { TSReference } from '@nuxt/kit'
import { requireModule, getModulePaths, getNearestPackage } from '../utils/cjs'
import { success } from '../utils/log'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'prepare',
    usage: 'npx nuxi prepare',
    description: 'Prepare nuxt for development/build'
  },
  async invoke (args) {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    const rootDir = resolve(args._[0] || '.')

    const { loadNuxt } = requireModule('@nuxt/kit', rootDir) as typeof import('@nuxt/kit')
    const nuxt = await loadNuxt({ rootDir })

    const adHocModules = nuxt.options._majorVersion === 3
      ? ['@nuxt/kit', '@nuxt/nitro']
      : ['@nuxt/kit']

    const modulePaths = getModulePaths(nuxt.options.modulesDir)

    const references: TSReference[] = [
      'nuxt3',
      ...adHocModules,
      ...nuxt.options.buildModules,
      ...nuxt.options.modules,
      ...nuxt.options._modules
    ]
      .filter(f => typeof f === 'string')
      .map(id => ({ types: getNearestPackage(id, modulePaths)?.name || id }))

    const declarations: string[] = []

    await nuxt.callHook('builder:generateApp')
    await nuxt.callHook('prepare:types', { references, declarations })

    const declarationPath = resolve(`${rootDir}/nuxt.d.ts`)

    const declaration = [
      '// This file is auto generated by `nuxt prepare`',
      '// Please do not manually modify this file.',
      '',
      ...references.map((ref) => {
        if ('path' in ref) {
          ref.path = relative(rootDir, ref.path)
        }
        return `/// <reference ${renderAttrs(ref)} />`
      }),
      ...declarations,
      'export {}',
      ''
    ].join('\n')

    await fsp.writeFile(declarationPath, declaration)

    success('Generated', cyan(relative(process.cwd(), declarationPath)))
  }
})

function renderAttrs (obj) {
  return Object.entries(obj).map(e => renderAttr(e[0], e[1])).join(' ')
}

function renderAttr (key, value) {
  return value ? `${key}="${value}"` : ''
}
