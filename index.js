'use strict'

var async = require('async')
var _ = require('lodash')
var SurbtcRestClient = require('surbtc-rest-client')
var surbtcRestClientApiUrl = require('./config/surbtc_rest_client_options').apiUrl()
var surbtcRestClientApiKey = require('./config/surbtc_rest_client_options').apiKey()

function Maker (options) {
  this.bridgeCurrency = options.bridgeCurrency || 'BTC'
  this.sourceCurrencyDepositFee = options.sourceCurrencyDepositFee || 0
  this.destinationCurrencyWithdrawalFee = options.destinationCurrencyWithdrawalFee || 0.01
  this.dinexFee = options.dinexFee || 0.02
  this.btcInsurance = options.btcInsurance || 0.015
}

Maker.prototype._calculateQuotationFixedSource = function (options, callback) {
  var self = this

  var marketExchangeRate = options.reverseQuotation.total / options.sourceAmountCents
  var marketExchangerateActual = marketExchangeRate * (1 - self.btcInsurance)
  var destinationAmountNoFees = _.toInteger(options.sourceAmount * marketExchangerateActual)
  var dinexFeeTotalAmount = _.toInteger(options.sourceAmount * self.dinexFee)
  var sourceCurrencyDepositFeeAmount = _.toInteger(options.sourceAmount * self.sourceCurrencyDepositFee)
  var destinationAmontMinusDinexFee = _.toInteger(options.sourceAmount * (1 - self.dinexFee) * marketExchangerateActual)
  var destinationAmountMinusDinexFeeAndDepositFee = _.toInteger(options.sourceAmount * (1 - self.dinexFee) * (1 - self.sourceCurrencyDepositFee) * marketExchangerateActual)
  var destinationCurrencyWithdrawalFeeAmount = _.toInteger(options.sourceAmount * (1 - self.dinexFee) * (1 - self.sourceCurrencyDepositFee) * marketExchangerateActual * self.destinationCurrencyWithdrawalFee)
  var destinationAmountMinusDinexFeeAndDepositFeeAndWithdrawalFee = _.toInteger(options.sourceAmount * (1 - self.dinexFee) * (1 - self.sourceCurrencyDepositFee) * (1 - self.destinationCurrencyWithdrawalFee) * marketExchangerateActual)

  var result = {
    quotation: _.toNumber(options.quotation.amount),
    reverseQuotation: _.toNumber(options.reverseQuotation.total),
    marketExchangeRate: marketExchangeRate,
    marketExchangerateActual: marketExchangerateActual,
    sourceAmount: options.sourceAmount,
    sourceCurrencyDepositFeeAmount: sourceCurrencyDepositFeeAmount,
    dinexFeeTotalAmount: dinexFeeTotalAmount,
    destinationCurrencyWithdrawalFeeAmount: destinationCurrencyWithdrawalFeeAmount,
    destinationAmountNoFees: destinationAmountNoFees,
    destinationAmontMinusDinexFee: destinationAmontMinusDinexFee,
    destinationAmountMinusDinexFeeAndDepositFee: destinationAmountMinusDinexFeeAndDepositFee,
    destinationAmountMinusDinexFeeAndDepositFeeAndWithdrawalFee: destinationAmountMinusDinexFeeAndDepositFeeAndWithdrawalFee
  }

  return callback(null, {success: true, quotation: result})
}

Maker.prototype.quoteRemittanceFixedSource = function (options, callback) {
  var self = this

  var client = new SurbtcRestClient({
    api: surbtcRestClientApiUrl,
    secret: surbtcRestClientApiKey
  })

  if (!options.sourceCurrency) {
    return callback({success: false, error_type: 'sourceCurrency_required'}, null)
  }

  if (!(options.sourceAmount && _.isFinite(options.sourceAmount))) {
    return callback({success: false, error_type: 'sourceAmount_invalid'}, null)
  }

  if (options.sourceCurrency === 'CLP') {
    var marketId = 'BTC-CLP'
    var type = 'Bid'
    var reverseMarket = 'BTC-COP'
    var reverseType = 'Ask'
    // convert source amount to cents
    options.sourceAmountCents = _.toInteger(options.sourceAmount) * 100

    async.waterfall([
      function (next) {
        client.getQuotation(marketId, type, options.sourceAmountCents, next)
      },
      function (quotation, next) {
        options.quotation = quotation.quotation
        client.getReverseQuotation(reverseMarket, reverseType, _.toNumber(options.quotation.amount), next)
      },
      function (reverseQuotation, next) {
        options.reverseQuotation = reverseQuotation.reverse_quotation
        self._calculateQuotationFixedSource(options, next)
      }
    ], callback)
  } else {
    return callback({success: false, error_type: 'sourceCurrency_invalid'}, null)
  }
}

module.exports = Maker
