import { ObjectStoreBuckets } from "../../constants"
import {
  extractPluginTarball,
  createNpmPlugin,
  createUrlPlugin,
  createGithubPlugin,
  loadJSFile,
} from "../../utilities/fileSystem"
import { getGlobalDB } from "@budibase/backend-core/tenancy"
import { generatePluginID, getPluginParams } from "../../db/utils"
import {
  uploadDirectory,
  deleteFolder,
} from "@budibase/backend-core/objectStore"
import { PluginType, FileType } from "@budibase/types"
import env from "../../environment"

export async function getPlugins(type?: PluginType) {
  const db = getGlobalDB()
  const response = await db.allDocs(
    getPluginParams(null, {
      include_docs: true,
    })
  )
  const plugins = response.rows.map((row: any) => row.doc)
  if (type) {
    return plugins.filter((plugin: any) => plugin.schema?.type === type)
  } else {
    return plugins
  }
}

export async function upload(ctx: any) {
  const { source } = ctx.params
  const plugins: FileType[] =
    ctx.request.files.file.length > 1
      ? Array.from(ctx.request.files.file)
      : [ctx.request.files.file]
  try {
    let docs = []
    // can do single or multiple plugins
    for (let plugin of plugins) {
      const doc = await processPlugin(plugin, source)
      docs.push(doc)
    }
    ctx.body = {
      message: "Plugin(s) uploaded successfully",
      plugins: docs,
    }
  } catch (err: any) {
    const errMsg = err?.message ? err?.message : err

    ctx.throw(400, `Failed to import plugin: ${errMsg}`)
  }
}

export async function create(ctx: any) {
  const { type, source, url, headers, githubToken } = ctx.request.body
  let metadata
  let directory
  // Generating random name as a backup and needed for url
  let name = "PLUGIN_" + Math.floor(100000 + Math.random() * 900000)

  switch (source) {
    case "npm":
      const { metadata: metadataNpm, directory: directoryNpm } =
        await createNpmPlugin(url, name)
      metadata = metadataNpm
      directory = directoryNpm
      break
    case "github":
      const { metadata: metadataGithub, directory: directoryGithub } =
        await createGithubPlugin(ctx, url, name, githubToken)
      metadata = metadataGithub
      directory = directoryGithub
      break
    case "url":
      const { metadata: metadataUrl, directory: directoryUrl } =
        await createUrlPlugin(url, name, headers)
      metadata = metadataUrl
      directory = directoryUrl
      break
  }

  try {
    const doc = await storePlugin(metadata, directory, source)

    ctx.body = {
      message: "Plugin uploaded successfully",
      plugins: [doc],
    }
  } catch (err: any) {
    const errMsg = err?.message ? err?.message : err

    ctx.throw(400, `Failed to import plugin: ${errMsg}`)
  }
  ctx.status = 200
}

export async function fetch(ctx: any) {
  ctx.body = await getPlugins()
}

export async function destroy(ctx: any) {
  const db = getGlobalDB()
  const { pluginId, pluginRev } = ctx.params

  try {
    const plugin = await db.get(pluginId)
    const bucketPath = `${plugin.name}/`
    await deleteFolder(ObjectStoreBuckets.PLUGINS, bucketPath)

    await db.remove(pluginId, pluginRev)
  } catch (err: any) {
    const errMsg = err?.message ? err?.message : err

    ctx.throw(400, `Failed to delete plugin: ${errMsg}`)
  }

  ctx.message = `Plugin ${ctx.params.pluginId} deleted.`
  ctx.status = 200
}

export async function storePlugin(
  metadata: any,
  directory: any,
  source?: string
) {
  const db = getGlobalDB()
  const version = metadata.package.version,
    name = metadata.package.name,
    description = metadata.package.description

  // first open the tarball into tmp directory
  const bucketPath = `${name}/`
  const files = await uploadDirectory(
    ObjectStoreBuckets.PLUGINS,
    directory,
    bucketPath
  )
  const jsFile = files.find((file: any) => file.name.endsWith(".js"))
  if (!jsFile) {
    throw new Error(`Plugin missing .js file.`)
  }
  // validate the JS for a datasource
  if (metadata.schema.type === PluginType.DATASOURCE) {
    const js = loadJSFile(directory, jsFile.name)
    // TODO: this isn't safe - but we need full node environment
    // in future we should do this in a thread for safety
    try {
      eval(js)
    } catch (err: any) {
      const message = err?.message ? err.message : JSON.stringify(err)
      throw new Error(`JS invalid: ${message}`)
    }
  }
  const jsFileName = jsFile.name
  const pluginId = generatePluginID(name)

  // overwrite existing docs entirely if they exist
  let rev
  try {
    const existing = await db.get(pluginId)
    rev = existing._rev
  } catch (err) {
    rev = undefined
  }
  const doc = {
    _id: pluginId,
    _rev: rev,
    source,
    ...metadata,
    name,
    version,
    description,
    jsUrl: `${bucketPath}${jsFileName}`,
  }
  const response = await db.put(doc)
  return {
    ...doc,
    _rev: response.rev,
  }
}

export async function processPlugin(plugin: FileType, source?: string) {
  if (!env.SELF_HOSTED) {
    throw new Error("Plugins not supported outside of self-host.")
  }

  const { metadata, directory } = await extractPluginTarball(plugin)
  return await storePlugin(metadata, directory, source)
}
