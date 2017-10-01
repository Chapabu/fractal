const {uniqueId} = require('@frctl/utils');
const check = require('check-types');
const Variant = require('../entities/variant');
const EntityCollection = require('./entity-collection');
const Collection = require('./collection');

const assert = check.assert;

const _variantNames = new WeakMap();
const _component = new WeakMap();
const _default = new WeakMap();

class VariantCollection extends EntityCollection {

  constructor(items = [], component) {
    super([]);
    this._configure(component, []);
    this._setItems(items);
  }

  getDefault() {
    return _default.get(this);
  }

  hasDefault() {
    return Boolean(_default.get(this));
  }

  //
  // Overridden methods
  //

  _new(items) {
    return new this.constructor(items, _component.get(this));
  }

  //
  // /end Overridden methods
  //

  /*
   * find('id')
   * find('prop', value)
   * find({prop: value})
   * find(fn)
   */
  find(...args) {
    if (args.length === 1 && typeof args[0] === 'string') {
      return super.find('id', args[0]);
    }
    return super.find(...args);
  }

  _castItems(items) {
    if (items.length === 0) {
      return items;
    }
    const defaultItem = getDefault(items);

    return items.map(i => {
      delete i.default;
      const variant = createVariant(this, i);
      if (i === defaultItem) {
        setDefault(this, variant);
      }
      return variant;
    });
  }

  _validateOrThrow(items) {
    const isValid = VariantCollection.validate(items);
    assert(
      isValid,
      `VariantCollection.constructor: The 'items' argument is optional but must be an array of Variants [items-invalid]`,
      TypeError
    );
    return isValid;
  }

  _configure(component, variantNames) {
    _component.set(this, component);
    _variantNames.set(this, variantNames);
    _default.set(this, undefined);
  }

  _setItems(items) {
    items = this._normaliseItems(items);
    if (items) {
      try {
        items = this._castItems(items);
      } catch (err) {
        if (err instanceof TypeError) {
          assert(
            false,
            `VariantCollection.constructor: The 'items' argument is optional but must be an array of Variants or pre-Variant objects [items-invalid]: ${err.message}`,
            TypeError
          );
        } else {
          throw err;
        }
      }
    }
    this._validateOrThrow(items);
    this._items = items;
  }

  get component() {
    return _component.get(this);
  }

  get [Symbol.toStringTag]() {
    return 'VariantCollection';
  }

  static validate(items) {
    return check.maybe.array.of.instance(items, Variant);
  }
}

function setDefault(target, variant) {
  _default.set(target, variant);
}

function getDefault(variants) {
  let defaultItem;
  if (variants.length > 0) {
    const defaultDefined = variants.filter(v => v.default === true).reduceRight((acc, current) => current, undefined);
    defaultItem = defaultDefined ? defaultDefined : variants[0];
  }
  return defaultItem;
}

function createVariant(target, props = {}) {
  const isValidVariant = check.maybe.instance(props, Variant);
  const isValidProp = check.maybe.object(props);
  const component = target.component;
  let config;

  assert(
    (isValidProp || isValidVariant),
    `VariantCollection.createVariant: The 'props' argument is optional but must be an object [props-invalid]`,
    TypeError
  );

  if (isValidVariant) {
    config = props;
  } else {
    config = Object.assign({}, props);
  }

  config.id = uniqueId(props.id || 'variant', _variantNames.get(target));
  config.component = component.id;

  if (!config.templates) {
    config.templates = {};
    component.getViews().filter(view => view.contents).forEach(view => {
      config.templates[view.basename] = view.contents.toString();
    });
  }

  return Variant.from(config);
}

Collection.addEntityDefinition(Variant, VariantCollection);
Collection.addTagDefinition('VariantCollection', VariantCollection);

module.exports = VariantCollection;
