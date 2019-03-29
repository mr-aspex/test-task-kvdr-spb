const { dbQueryFn } = require('./db');
const { ServerError, LogicError } = require('../helpers/errors');
const { Field, QueryBuilder, SQLCONST } = require('../helpers/queryBuilder');

class Repository {
  constructor({ table, map, strictMode }) {
    this.dbQueryFn = dbQueryFn;
    this.table = table;
    this.map = map;
    this.strictMode = strictMode;

    if (strictMode) {
      if (!map) throw new ServerError('map is required in strict query');
    }
    if (map && !(map instanceof Map)) {
      throw new ServerError('bad iput parameter');
    }
    if (map) {
      map.forEach(val => {
        if (!(Reflect.has(val, 'field') && Reflect.has(val, 'field'))) {
          throw new ServerError('map must have {fields, alias} structure');
        }
      });
    }
  }

  mapFieldNames(key) {
    if (this.map) {
      const data = this.map.get(key);
      if (this.strictMode && !data) {
        throw new LogicError('field not in list');
      }
      return data || { field: key, alias: key };
    }
    return { field: key, alias: key };
  }

  mapField(key, query) {
    const { alias, field } = this.mapFieldNames(key);
    return this.table.field(field).as(alias, query);
  }

  async find(options) {
    let { conditions, fields } = options;
    const { pagination } = options;

    const query = new QueryBuilder(dbQueryFn);
    if (conditions) {
      conditions = Object.entries(conditions).map(([key, vals]) => {
        const field = this.mapField(key);
        if (typeof vals === 'object') {
          const { operator, value } = vals;
          return [field, operator, value];
        }
        return [field, vals];
      });
    }

    if (fields) {
      fields = fields.map(f => this.mapField(f));
    } else {
      fields = [new Field(SQLCONST.STAR)];
    }

    return query
      .select(fields)
      .from(this.table)
      .where(conditions)
      .limitOffset(pagination)
      .execute();
  }

  async findOne(...options) {
    const [one] = await this.find(...options);
    return one;
  }
}

module.exports = Repository;