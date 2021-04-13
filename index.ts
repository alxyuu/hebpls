import { Builder, By, WebDriver, WebElement } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
import fetch from "node-fetch";

// CHANGE THESE
const SEARCH_ZIP = 77904;
const SEARCH_RADIUS = 20;

let searchStores: Record<number, number> = {};

const clickTimes = async (driver: WebDriver) => {
  const times: WebElement = await driver.executeScript(
    `return document.getElementById('container').children[0].getElementsByTagName('input')[2]`
  );

  await times!.click();
};

const register = async (url: string) => {
  const options = new chrome.Options();
  options.addArguments("--disable-blink-features=AutomationControlled");
  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  await driver.manage().window().maximize();
  await driver.get(url);

  try {
    const currentUrl = await driver.getCurrentUrl();

    if (currentUrl.startsWith("https://vaccine.heb.com")) {
      throw new Error("Link expired");
    }

    await driver.wait(async () => {
      try {
        const loader = await driver.findElement({
          className: "loading-spinner",
        });
        const displayed = await loader.isDisplayed();
        if (displayed) {
          return false;
        }

        return true;
      } catch (e) {
        return false;
      }
    }, 10000);

    let noAppointments;

    try {
      noAppointments = await driver.findElement(
        By.xpath(
          "//*[contains(text(), 'Appointments are no longer available for this location.')]"
        )
      );
    } catch {}

    if (noAppointments) {
      throw new Error("Appointments no longer available");
    }

    let dates: WebElement;

    await driver.wait(async () => {
      try {
        dates = await driver.executeScript(
          `return document.getElementById('container').children[0].getElementsByTagName('input')[1]`
        );

        if (!dates) {
          return false;
        }

        return true;
      } catch {
        return false;
      }
    }, 5000);

    await dates!.click();

    const dateOptions = await driver.executeScript<WebElement[]>(
      `return document.getElementById('container').children[0].getElementsByTagName('lightning-base-combobox-item')`
    );

    if (!dateOptions || dateOptions.length === 0) {
      throw new Error("No date options");
    }

    for (let i = 0; i < dateOptions.length; i++) {
      if (i > 0) {
        await dates!.click();
      }

      await dateOptions[i].click();

      await clickTimes(driver);

      const timeOptions = (
        await driver.executeScript<WebElement[]>(
          `return document.getElementById('container').children[0].getElementsByTagName('lightning-base-combobox-item')`
        )
      ).slice(dateOptions.length);

      for (let k = 0; k < timeOptions.length; k++) {
        const optionText = await timeOptions[k].getText();

        if (optionText.includes("Moderna") || optionText.includes("Pfizer")) {
          await timeOptions[k].click();

          const submit: WebElement = await driver.executeScript(
            `return document.getElementById('container').children[0].getElementsByTagName('button')[0]`
          );

          await submit.click();

          await driver.wait(async () => {
            try {
              const loader = await driver.executeScript<WebElement>(
                `return document.getElementById('container').children[0].getElementsByTagName('lightning-spinner')[0]`
              );

              if (loader) {
                return false;
              }

              return true;
            } catch {
              return false;
            }
          }, 5000);

          const error = await driver.executeScript<WebElement>(
            `return document.getElementById('container').children[0].getElementsByClassName('page-error')[0]`
          );

          if (!error) {
            await driver.executeScript(`alert('appointment ready!')`);
            return;
          }

          await clickTimes(driver);
        }
      }

      await clickTimes(driver);
    }

    throw new Error("all timeslots full");
  } catch (e) {
    await driver.quit();
    throw e;
  }
};

let interval: NodeJS.Timeout;

const fetchResults = async () => {
  process.stdout.write(".");

  const results = await fetch(
    "https://heb-ecom-covid-vaccine.hebdigital-prd.com/vaccine_locations.json",
    {
      method: "GET",
    }
  );
  const { locations } = await results.json();

  const available = locations.filter(
    (location: any) =>
      !!location.url &&
      !!searchStores[location.storeNumber] &&
      !!location.slotDetails.find(
        (detail: any) =>
          detail.manufacturer === "Pfizer" || detail.manufacturer === "Moderna"
      )
  );
  const sorted = available.sort(
    (a: any, b: any) =>
      searchStores[a.storeNumber] - searchStores[b.storeNumber]
  );

  if (sorted[0]) {
    clearInterval(interval);
    console.log("\nfound at " + sorted[0].name);
    register(sorted[0].url).catch((e) => {
      console.log(e);
      startSearch();
    });
  }
};

const startSearch = () => {
  fetchResults();
  interval = setInterval(fetchResults, 2000);
};

const fetchLocations = () => {
  const query = [
    {
      operationName: "StoreSearch",
      variables: {
        address: SEARCH_ZIP.toString(),
        radius: SEARCH_RADIUS,
        fulfillmentChannels: [],
      },
      query:
        "query StoreSearch($address: String!, $radius: Int!, $fulfillmentChannels: [FulfillmentChannelName]) {\n  searchStoresByAddress(\n    address: $address\n    radiusMiles: $radius\n    fulfillmentChannels: $fulfillmentChannels\n  ) {\n    stores {\n      distanceMiles\n      store {\n        storeNumber\n        name\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}",
    },
  ];
  return fetch("https://api-edge.heb-ecom-api.hebdigital-prd.com/graphql", {
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(query),
    method: "POST",
  })
    .then((res) => res.json())
    .then(([result]) => result.data.searchStoresByAddress.stores)
    .then(
      (stores) =>
        (searchStores = stores
          .map((store: any) => ({
            number: store.store.storeNumber,
            distance: store.distanceMiles,
            name: store.store.name,
          }))
          .reduce((acc: any, cur: any) => {
            console.log(
              `Searching ${cur.name} (${cur.distance.toFixed(2)}mi away)`
            );
            acc[cur.number] = cur.distance;
            return acc;
          }, {}))
    );
};

fetchLocations().then(() => {
  startSearch();
});
