# Space/Time ETL module: OldNYC

[ETL](https://en.wikipedia.org/wiki/Extract,_transform,_load) module for NYPL's [NYC Space/Time Direcory](http://spacetime.nypl.org/). This Node.js module downloads, parses, and/or transforms OldNYC data, and creates a NYC Space/Time Directory dataset.

## Details

<table>
  <tbody>

    <tr>
      <td>ID</td>
      <td><code>oldnyc</code></td>
    </tr>

    <tr>
      <td>Title</td>
      <td>OldNYC</td>
    </tr>

    <tr>
      <td>Description</td>
      <td>OldNYC provides an alternative way of browsing the NYPL's incredible Photographic Views of New York City, 1870s-1970s collection. Its goal is to help you discover the history behind the places you see every day.</td>
    </tr>

    <tr>
      <td>License</td>
      <td>CC BY-NC</td>
    </tr>

    <tr>
      <td>Author</td>
      <td>Dan Vanderkam</td>
    </tr>

    <tr>
      <td>Website</td>
      <td><a href="https://www.oldnyc.org/">https://www.oldnyc.org/</a></td>
    </tr>
  </tbody>
</table>

## Available steps

  - `download`
  - `transform`

## Usage

```
git clone https://github.com/nypl-spacetime/etl-oldnyc.git /path/to/etl-modules
cd /path/to/etl-modules/etl-oldnyc
npm install

spacetime-etl oldnyc [<step>]
```

See http://github.com/nypl-spacetime/spacetime-etl for information about Space/Time's ETL tool. More Space/Time ETL modules [can be found on GitHub](https://github.com/search?utf8=%E2%9C%93&q=org%3Anypl-spacetime+etl-&type=Repositories&ref=advsearch&l=&l=).

# Data

The dataset created by this ETL module's `transform` step can be found in the [data section of the NYC Space/Time Directory website](http://spacetime.nypl.org/#data-oldnyc).
