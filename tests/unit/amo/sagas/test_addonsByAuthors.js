import SagaTester from 'redux-saga-tester';

import addonsByAuthorsReducer, {
  EXTENSIONS_BY_AUTHORS_PAGE_SIZE,
  THEMES_BY_AUTHORS_PAGE_SIZE,
  fetchAddonsByAuthors,
  loadAddonsByAuthors,
} from 'amo/reducers/addonsByAuthors';
import addonsByAuthorsSaga from 'amo/sagas/addonsByAuthors';
import {
  ADDON_TYPE_THEME,
  SEARCH_SORT_TRENDING,
} from 'core/constants';
import * as searchApi from 'core/api/search';
import apiReducer from 'core/reducers/api';
import {
  createAddonsApiResult,
  dispatchClientMetadata,
  fakeAddon,
} from 'tests/unit/amo/helpers';
import { createStubErrorHandler } from 'tests/unit/helpers';


describe(__filename, () => {
  let errorHandler;
  let mockApi;
  let sagaTester;

  beforeEach(() => {
    errorHandler = createStubErrorHandler();
    mockApi = sinon.mock(searchApi);
    sagaTester = new SagaTester({
      initialState: dispatchClientMetadata().state,
      reducers: {
        api: apiReducer,
        addonsByAuthorNames: addonsByAuthorsReducer,
      },
    });
    sagaTester.start(addonsByAuthorsSaga);
  });

  function _fetchAddonsByAuthors(params) {
    sagaTester.dispatch(fetchAddonsByAuthors({
      errorHandlerId: errorHandler.id,
      ...params,
    }));
  }

  it('calls the API with addonType if set', async () => {
    const addons = [fakeAddon];
    const authorUsernames = ['mozilla'];
    const state = sagaTester.getState();

    mockApi
      .expects('search')
      .withArgs({
        api: state.api,
        filters: {
          addonType: ADDON_TYPE_THEME,
          author: authorUsernames.sort().join(','),
          exclude_addons: undefined, // `callApi` will internally unset this
          page_size: THEMES_BY_AUTHORS_PAGE_SIZE,
          sort: SEARCH_SORT_TRENDING,
        },
      })
      .once()
      .returns(Promise.resolve(createAddonsApiResult(addons)));

    _fetchAddonsByAuthors({ authorUsernames, addonType: ADDON_TYPE_THEME });

    const expectedLoadAction = loadAddonsByAuthors({
      addons,
      addonType: ADDON_TYPE_THEME,
      authorUsernames,
      forAddonSlug: undefined,
    });

    const loadAction = await sagaTester.waitFor(expectedLoadAction.type);
    mockApi.verify();

    expect(loadAction).toEqual(expectedLoadAction);
  });

  it('sends `exclude_addons` param if `forAddonSlug` is set', async () => {
    const addons = [fakeAddon];
    const authorUsernames = ['mozilla', 'johnedoe'];
    const { slug } = fakeAddon;
    const state = sagaTester.getState();

    mockApi
      .expects('search')
      .withArgs({
        api: state.api,
        filters: {
          addonType: undefined,
          author: authorUsernames.sort().join(','),
          exclude_addons: slug,
          page_size: EXTENSIONS_BY_AUTHORS_PAGE_SIZE,
          sort: SEARCH_SORT_TRENDING,
        },
      })
      .once()
      .returns(Promise.resolve(createAddonsApiResult(addons)));

    _fetchAddonsByAuthors({ authorUsernames, forAddonSlug: slug });

    const expectedLoadAction = loadAddonsByAuthors({
      addons,
      authorUsernames,
      forAddonSlug: slug,
    });

    const loadAction = await sagaTester.waitFor(expectedLoadAction.type);
    mockApi.verify();

    expect(loadAction).toEqual(expectedLoadAction);
  });

  it('clears the error handler', async () => {
    _fetchAddonsByAuthors({ authorUsernames: [], forAddonSlug: fakeAddon.slug });

    const expectedAction = errorHandler.createClearingAction();

    const errorAction = await sagaTester.waitFor(expectedAction.type);

    expect(errorAction).toEqual(errorHandler.createClearingAction());
  });

  it('dispatches an error', async () => {
    const error = new Error('some API error maybe');
    mockApi
      .expects('search')
      .once()
      .returns(Promise.reject(error));

    _fetchAddonsByAuthors({ authorUsernames: [], forAddonSlug: fakeAddon.slug });

    const errorAction = errorHandler.createErrorAction(error);
    const calledErrorAction = await sagaTester.waitFor(errorAction.type);

    expect(calledErrorAction).toEqual(errorAction);
  });

  it('handles no API results', async () => {
    const addons = [];
    const authorUsernames = ['mozilla', 'johnedoe'];
    const { slug } = fakeAddon;
    const state = sagaTester.getState();

    mockApi
      .expects('search')
      .withArgs({
        api: state.api,
        filters: {
          addonType: undefined,
          author: authorUsernames.sort().join(','),
          exclude_addons: slug,
          page_size: EXTENSIONS_BY_AUTHORS_PAGE_SIZE,
          sort: SEARCH_SORT_TRENDING,
        },
      })
      .once()
      .returns(Promise.resolve(createAddonsApiResult(addons)));

    _fetchAddonsByAuthors({ authorUsernames, forAddonSlug: slug });

    const expectedLoadAction = loadAddonsByAuthors({
      addons,
      authorUsernames,
      forAddonSlug: slug,
    });

    const loadAction = await sagaTester.waitFor(expectedLoadAction.type);
    mockApi.verify();

    expect(loadAction).toEqual(expectedLoadAction);
  });
});
