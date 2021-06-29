import { Knex, knex } from "knex"
const BASE_LIMIT = 5000
import {
  QueryJson,
  SearchFilters,
  QueryOptions,
  SortDirection,
  Operation,
} from "./definitions"

function addFilters(
  query: any,
  filters: SearchFilters | undefined
): Knex.QueryBuilder {
  function iterate(
    structure: { [key: string]: any },
    fn: (key: string, value: any) => void
  ) {
    for (let [key, value] of Object.entries(structure)) {
      fn(key, value)
    }
  }
  if (!filters) {
    return query
  }
  // if all or specified in filters, then everything is an or
  const allOr = filters.allOr
  if (filters.string) {
    iterate(filters.string, (key, value) => {
      const fnc = allOr ? "orWhere" : "where"
      query = query[fnc](key, "like", `${value}%`)
    })
  }
  if (filters.range) {
    iterate(filters.range, (key, value) => {
      if (!value.high || !value.low) {
        return
      }
      const fnc = allOr ? "orWhereBetween" : "whereBetween"
      query = query[fnc](key, [value.low, value.high])
    })
  }
  if (filters.equal) {
    iterate(filters.equal, (key, value) => {
      const fnc = allOr ? "orWhere" : "where"
      query = query[fnc]({ [key]: value })
    })
  }
  if (filters.notEqual) {
    iterate(filters.notEqual, (key, value) => {
      const fnc = allOr ? "orWhereNot" : "whereNot"
      query = query[fnc]({ [key]: value })
    })
  }
  if (filters.empty) {
    iterate(filters.empty, key => {
      const fnc = allOr ? "orWhereNull" : "whereNull"
      query = query[fnc](key)
    })
  }
  if (filters.notEmpty) {
    iterate(filters.notEmpty, key => {
      const fnc = allOr ? "orWhereNotNull" : "whereNotNull"
      query = query[fnc](key)
    })
  }
  return query
}

function buildCreate(knex: Knex, json: QueryJson, opts: QueryOptions) {
  const { endpoint, body } = json
  let query = knex(endpoint.entityId)
  // mysql can't use returning
  if (opts.disableReturning) {
    return query.insert(body)
  } else {
    return query.insert(body).returning("*")
  }
}

function buildRead(knex: Knex, json: QueryJson, limit: number) {
  let { endpoint, resource, filters, sort, paginate } = json
  let query: Knex.QueryBuilder = knex(endpoint.entityId)
  // select all if not specified
  if (!resource) {
    resource = { fields: [] }
  }
  // handle select
  if (resource.fields && resource.fields.length > 0) {
    query = query.select(resource.fields)
  } else {
    query = query.select("*")
  }
  // handle where
  query = addFilters(query, filters)
  // handle sorting
  if (sort) {
    for (let [key, value] of Object.entries(sort)) {
      const direction = value === SortDirection.ASCENDING ? "asc" : "desc"
      query = query.orderBy(key, direction)
    }
  }
  // handle pagination
  if (paginate && paginate.page && paginate.limit) {
    // @ts-ignore
    const page = paginate.page <= 1 ? 0 : paginate.page - 1
    const offset = page * paginate.limit
    query = query.offset(offset).limit(paginate.limit)
  } else if (paginate && paginate.limit) {
    query = query.limit(paginate.limit)
  } else {
    query.limit(limit)
  }
  return query
}

function buildUpdate(knex: Knex, json: QueryJson, opts: QueryOptions) {
  const { endpoint, body, filters } = json
  let query = knex(endpoint.entityId)
  query = addFilters(query, filters)
  // mysql can't use returning
  if (opts.disableReturning) {
    return query.update(body)
  } else {
    return query.update(body).returning("*")
  }
}

function buildDelete(knex: Knex, json: QueryJson, opts: QueryOptions) {
  const { endpoint, filters } = json
  let query = knex(endpoint.entityId)
  query = addFilters(query, filters)
  // mysql can't use returning
  if (opts.disableReturning) {
    return query.delete()
  } else {
    return query.delete().returning("*")
  }
}

class SqlQueryBuilder {
  private readonly sqlClient: string
  private readonly limit: number
  // pass through client to get flavour of SQL
  constructor(client: string, limit: number = BASE_LIMIT) {
    this.sqlClient = client
    this.limit = limit
  }

  /**
   * @param json the input JSON structure from which an SQL query will be built.
   * @return {string} the operation that was found in the JSON.
   */
  _operation(json: QueryJson): Operation {
    return json.endpoint.operation
  }

  /**
   * @param json The JSON query DSL which is to be converted to SQL.
   * @param opts extra options which are to be passed into the query builder, e.g. disableReturning
   * which for the sake of mySQL stops adding the returning statement to inserts, updates and deletes.
   * @return {{ sql: string, bindings: object }} the query ready to be passed to the driver.
   */
  _query(json: QueryJson, opts: QueryOptions = {}) {
    const client = knex({ client: this.sqlClient })
    let query
    switch (this._operation(json)) {
      case Operation.CREATE:
        query = buildCreate(client, json, opts)
        break
      case Operation.READ:
        query = buildRead(client, json, this.limit)
        break
      case Operation.UPDATE:
        query = buildUpdate(client, json, opts)
        break
      case Operation.DELETE:
        query = buildDelete(client, json, opts)
        break
      default:
        throw `Operation type is not supported by SQL query builder`
    }
    return query.toSQL().toNative()
  }
}

module.exports = SqlQueryBuilder
