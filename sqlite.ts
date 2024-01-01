type SqliteTypeJs = null | number | string;
type SqliteTypeSql = "null" | "integer" | "real" | "text";

class SqliteType<T extends SqliteTypeJs> {
  _type!: T;
  typestring: SqliteTypeSql;
  #primary = false;
  #required = false;
  #default?: T;
  constructor(type: SqliteTypeSql) {
    this.typestring = type;
  }
  primary() {
    this.#primary = true;
    this.#required = true; // patching an old SQLite bug
    return this;
  }
  required() {
    this.#required = true;
    return this;
  }
  default(val: T) {
    this.#default = val;
    return this;
  }
  toSql(name: string) {
    let sql = `"${name}" ${this.typestring}`;
    if (this.#primary) sql += " primary key";
    if (this.#required) sql += " not null";
    if (this.#default) sql += ` default ${this.#default}`;
    return sql;
  }
}

type SqliteNull = SqliteType<null>;
type SqliteInteger = SqliteType<number>;
type SqliteReal = SqliteType<number>;
type SqliteText = SqliteType<string>;

let integer = () => new SqliteType<number>("integer");
let real = () => new SqliteType<number>("real");
let text = () => new SqliteType<string>("text");

class Table<T extends Columns> {
  _type!: T;
  name: string;
  #cols: T;
  constructor(name: string, columns: T) {
    this.#cols = columns;
    this.name = name;
  }
  toSql() {
    let sql = `create table if not exists ${this.name} (\n  `;
    sql += Object.entries(this.#cols).map(([n, t]) => t.toSql(n)).join(",\n  ");
    sql += "\n) strict;";
    return sql;
  }
}

type Infer<T extends SqliteType<any>> = T["_type"];
type Simplify<T> = { [K in keyof T]: T[K] } & {};
type Columns = Record<string, SqliteType<any>>;
type TableType<S extends Columns> = Simplify<
  { [K in keyof S]: Infer<S[K]> }
>;

function table<C extends Columns>(name: string, columns: C) {
  return new Table<TableType<C>>(name, columns);
}

let posts2 = table("posts", {
  slug: text().primary(),
  title: text().required(),
  kind: text().required(),
  time: real().required(),
  date: text().required(),
  intro: text().required(),
  content: text().required(),
  raw: text().required(),
  draft: integer(),
  created: text().required().default("current_timestamp"),
});

console.log(posts2.toSql());
type x = typeof posts2._type;
